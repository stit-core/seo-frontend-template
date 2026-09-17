<script lang="ts">
  import Search from '../../search/ui/search.svelte'
  import PostCard from '@/entities/post/ui/post-card.svelte'
  import { Button } from '@/shared/ui/button'
</script>

<form>
  <Search />
  <PostCard title="x" />
  <Button label="send" />
</form>
