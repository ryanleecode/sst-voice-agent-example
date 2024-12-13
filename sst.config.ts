/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'voice-agent-example',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: ['production'].includes(input?.stage),
      home: 'aws',
    }
  },
  async run() {
    const { Config, pipe, Effect } = await import('effect')

    const env = pipe(
      Config.all({
        NODE_ENV: Config.nonEmptyString('NODE_ENV').pipe(
          Config.withDefault(!$dev ? 'production' : 'development'),
        ),
        DATABASE_URL: Config.nonEmptyString('DATABASE_URL'),
        OPENAI_API_KEY: Config.nonEmptyString('OPENAI_API_KEY'),
        DEEPGRAM_API_KEY: Config.nonEmptyString('DEEPGRAM_API_KEY'),
        LIVEKIT_API_KEY: Config.nonEmptyString('LIVEKIT_API_KEY'),
        LIVEKIT_API_SECRET: Config.nonEmptyString('LIVEKIT_API_SECRET'),
        LIVEKIT_URL: Config.nonEmptyString('LIVEKIT_URL'),
      }),
      Effect.runSync,
    )

    const vpc = new sst.aws.Vpc('VPC', { nat: 'ec2' })
    const cluster = new sst.aws.Cluster('Cluster', { vpc })

    cluster.addService('VoiceAgent', {
      dev: {
        command: 'bun run dev',
        directory: 'apps/voice-agent',
      },
      image: {
        dockerfile: 'apps/voice-agent/Dockerfile',
      },
      cpu: '1 vCPU',
      memory: '2 GB',
      environment: {
        ...env,
        SOCKET_PATH: '/tmp/voice-agent.sock',
      },
    })
  },
})
