<script lang="ts">
import { m } from '@/shared/i18n'
import { enhance } from '$app/forms'
import { HONEYPOT_FIELD } from '../config'

interface Props {
  form?: { errors?: Record<string, string>; values?: Record<string, string> } | null
  issuedAt: number
}
let { form = null, issuedAt }: Props = $props()
let pending = $state(false)
</script>

<form
  method="POST"
  use:enhance={() => {
    pending = true
    return async ({ update }) => {
      await update()
      pending = false
    }
  }}
>
  <input type="hidden" name="issuedAt" value={issuedAt}>

  <div class="field">
    <label for="name">{m.contact_name()}</label>
    <input
      id="name"
      name="name"
      required
      minlength="2"
      value={form?.values?.name ?? ''}
      autocomplete="name"
    >
    {#if form?.errors?.name}
      <small role="alert">{form.errors.name}</small>
    {/if}
  </div>

  <div class="field">
    <label for="email">{m.contact_email()}</label>
    <input
      id="email"
      name="email"
      type="email"
      required
      value={form?.values?.email ?? ''}
      autocomplete="email"
    >
    {#if form?.errors?.email}
      <small role="alert">{form.errors.email}</small>
    {/if}
  </div>

  <div class="field">
    <label for="message">{m.contact_message()}</label>
    <textarea
      id="message"
      name="message"
      rows="5"
      required
      minlength="10"
    >{form?.values?.message ?? ''}</textarea>
    {#if form?.errors?.message}
      <small role="alert">{form.errors.message}</small>
    {/if}
  </div>

  <div class="honeypot" aria-hidden="true">
    <label for={HONEYPOT_FIELD}>Не заполняйте это поле</label>
    <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} tabindex="-1" autocomplete="off">
  </div>

  <button class="button" type="submit" disabled={pending}>{m.contact_submit()}</button>
</form>
