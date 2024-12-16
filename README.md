# SST Voice Agent Example

A production-ready example of a Voice Agent that leverages WebRTC through [LiveKit](https://livekit.io/) to enable real-time voice interactions. This project showcases a unique architecture that bridges TypeScript and Python, enabling you to harness the best of both ecosystems.

## Architecture Overview

The project demonstrates several key technical innovations:

- **Python-TypeScript Bridge**: Uses `pybridge` (built on [Deepkit](https://deepkit.io/)) to seamlessly integrate Python code with a Bun server through reflection
- **IPC Communication**: Custom Hono server running on an IPC socket to enable bidirectional communication between Python and Bun processes
- **Vector Operations**: Efficient vector storage operations executed on the Bun side with results passed back to Python
- **Real-time Voice**: WebRTC-based voice communication powered by LiveKit

## Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime & toolkit
- Python 3.8+ 
- [Node.js](https://nodejs.org/) with [Corepack](https://nodejs.org/api/corepack.html)

## Setup

1. **Environment Setup**

Create a `.env` file with the following variables:

```sh
# Database Configuration
DATABASE_URL=          # Postgres connection string (local or Neon)

# API Keys
DEEPGRAM_API_KEY=     # For speech-to-text
OPENAI_API_KEY=       # For AI processing
LIVEKIT_API_KEY=      # For WebRTC
LIVEKIT_API_SECRET=   # For WebRTC
LIVEKIT_URL=          # Your LiveKit server URL

# Optional Configuration
LOG_LEVEL=DEBUG       # Logging verbosity
```

2. **Python Environment**

```sh
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r apps/voice-agent/requirements.txt
```

3. **Node Dependencies**

```sh
corepack pnpm install
```

4. **Start Development Server**

```sh
cd apps/voice-agent
pnpm dev
```

## Testing Your Agent

1. Visit [LiveKit Agents Playground](https://agents-playground.livekit.io/)
2. Connect to your running agent
3. Start interacting through voice!

## Customization

### Basic Customization

1. Modify `apps/voice-agent/main.py` to adjust agent behavior
2. Update vector database embeddings for different knowledge domains

### Advanced Customization

- Extend the Python-TypeScript bridge in `packages/pybridge`
- Modify vector storage operations in `packages/llama-index-storage`
- Customize the Hono server in `packages/vector-storage-hono`

## Infrastructure Options

### Database

You have two options for the PostgreSQL database:

1. **Local Development**: Run PostgreSQL in Docker
2. **Cloud Hosted**: Use [Neon Database](https://neon.tech/) for serverless PostgreSQL

### Required Services

- [Deepgram](https://deepgram.com/) - Speech-to-text API
- [OpenAI](https://platform.openai.com/) - AI processing
- [LiveKit Cloud](https://cloud.livekit.io/) - WebRTC infrastructure

## Deployment

### AWS Setup

1. Configure your AWS credentials:
```sh
aws configure
```

2. Install [Doppler](https://www.doppler.com/) for secrets management and set up your project:
```sh
# Set up Doppler project
doppler setup
```

3. Deploy to production:
```sh
doppler run -- npx sst deploy --stage=production
```

To remove the deployment:
```sh
npx sst remove --stage=production
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)
