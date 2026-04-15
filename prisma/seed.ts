import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultConfigs = [
  { key: 'late_threshold_minutes', value: '30', label: 'Late Threshold (minutes)' },
  { key: 'very_late_threshold_minutes', value: '120', label: 'Very Late Threshold (minutes)' },
  { key: 'away_check_interval_minutes', value: '30', label: 'Away Check Interval (minutes)' },
  { key: 'max_sessions_per_user', value: '10', label: 'Max Concurrent Sessions Per User' },
  { key: 'ai_model', value: 'qwen/qwen3-235b-a22b:free', label: 'AI Model (OpenRouter)' },
  { key: 'otp_max_attempts', value: '5', label: 'OTP Max Attempts Before Block' },
  { key: 'otp_block_minutes', value: '30', label: 'OTP Block Duration (minutes)' },
]

async function main() {
  console.log('Seeding SystemConfig defaults...')

  for (const config of defaultConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    })
    console.log(`  ✓ ${config.key}`)
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
