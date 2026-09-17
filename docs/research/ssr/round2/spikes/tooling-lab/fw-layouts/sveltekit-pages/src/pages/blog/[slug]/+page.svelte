<script lang="ts">
  import { PostArticle } from '@/widgets/post-article'
  import type { Post } from '@/entities/post/model/schema'
  let p: Post[] = []
</script>
<PostArticle />{p.length}
