import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { include: ['tests/int/**/*.int.spec.ts'], fileParallelism: false, hookTimeout: 900_000, testTimeout: 900_000 } })
