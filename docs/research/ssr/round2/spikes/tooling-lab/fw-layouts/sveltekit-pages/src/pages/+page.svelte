<script lang="ts">
  import { Hero } from '@/widgets/hero'
  import type { Post } from '@/entities/post/model/schema'
  let p: Post[] = []
</script>
<Hero />{p.length}
