export default [
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        {
          group: ['@/entities/*/*', '@/features/*/*', '@/widgets/*/*', '@/pages/*/*'],
          message: 'слайс: мимо public API',
        },
        {
          group: ['@/shared/*/*', '!@/shared/ui/*', '!@/shared/lib/*', '@/shared/ui/*/*', '@/shared/lib/*/*'],
          message: 'shared: мимо public API сегмента',
        },
      ] }],
    },
  },
]
