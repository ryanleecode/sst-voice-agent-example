import logging
import math
import os
from typing import NotRequired, TypedDict, Literal

from livekit.plugins import deepgram, openai, silero, llama_index
from llama_index.llms.openai import OpenAI
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
    JobProcess,
)
from llama_index.core import Settings
from llama_index.core import VectorStoreIndex
from livekit.agents.pipeline import VoicePipelineAgent
from llama_index.embeddings.openai import OpenAIEmbedding, OpenAIEmbeddingModelType
from ipc_vector_store import IPCVectorStore
from livekit import rtc
from llama_index.core.chat_engine.types import ChatMode
import asyncio

Settings.embed_model = OpenAIEmbedding(
    model=OpenAIEmbeddingModelType.TEXT_EMBED_3_SMALL
)

vector_store = IPCVectorStore(socket_path="/tmp/voice-agent.sock")
index = VectorStoreIndex.from_vector_store(vector_store)
logger = logging.getLogger("voice-agent")

class StartConfig(TypedDict):
    log_level: NotRequired[Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]]
    drain_timeout: NotRequired[int]
    devmode: bool

def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()

def start(config: StartConfig = {}):
    devmode = config.get("devmode")

    opts = WorkerOptions(
        entrypoint_fnc=entrypoint,
        prewarm_fnc=prewarm,
        ws_url=os.environ.get("LIVEKIT_URL"),
        load_threshold=math.inf if devmode else 0.75,
        initialize_process_timeout=60.0,
    )
    args = cli.proto.CliArgs(
        opts=opts,
        log_level=config.get("log_level", "INFO"),
        devmode=devmode,
        asyncio_debug=False,
        watch=False,
        drain_timeout=config.get("drain_timeout", 60),
    )
    cli.cli.run_worker(args)

async def entrypoint(ctx: JobContext):
    system_msg = llm.ChatMessage(
        role="system",
        content=f"""
You are a friendly and knowledgeable AI assistant engaging in voice conversations. Your responses must 
be based on the specific context provided to you - avoid generic answers. If information isn't in your 
context, acknowledge this rather than providing general information. Maintain a natural, conversational 
tone while being clear and concise. When drawing from your context, cite specific details to provide 
accurate and relevant information. Be direct in your responses while staying warm and professional. 
Avoid unnecessary formalities or repetitive phrases. Do not use any special formatting, markdown, 
bullet points, or symbols in your responses - provide plain, natural speech only as your responses 
will be converted to voice.
        """.strip()
    )

    condense_prompt_template = f"""
Given the following conversation between a user and an AI assistant and a follow-up question from the user:

Chat History:
{{chat_history}}

Follow Up Input: {{question}}

Rephrase the follow-up question to be a standalone question that captures the full context of the conversation.

Standalone question:
""".strip()

    chat_ctx = llm.ChatContext()
    chat_ctx.messages.append(system_msg)
    chat_engine = index.as_chat_engine(
        chat_mode=ChatMode.CONDENSE_PLUS_CONTEXT,
        llm=OpenAI(model="gpt-4o-mini", temperature=0.5),
        similarity_top_k=12,
        system_prompt=system_msg.content,
        condense_prompt=condense_prompt_template
    )

    assistant = VoicePipelineAgent(
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(),
        llm=llama_index.LLM(chat_engine=chat_engine),
        tts=openai.TTS(voice="echo"),
        chat_ctx=chat_ctx,
    )

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    assistant.start(ctx.room)

    await assistant.say(
        f"Hi, How can I assist you today?",
        allow_interruptions=True,
    )

    chat = rtc.ChatManager(ctx.room)

    async def answer_from_text(txt: str, assistant: VoicePipelineAgent):
        assistant._interrupt_if_possible()

        chat_ctx = assistant.chat_ctx
        chat_ctx.append(role="user", text=txt)
        stream = assistant.llm.chat(chat_ctx=chat_ctx.copy())
        await assistant.say(stream, allow_interruptions=True)

    @chat.on("message_received")
    def on_chat_received(msg: rtc.ChatMessage):
        if msg.message:
            asyncio.create_task(answer_from_text(msg.message, assistant))

if __name__ == "__main__":
    asyncio.run(start())
