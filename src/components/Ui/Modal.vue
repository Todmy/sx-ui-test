<script setup lang="ts">
import { watch, toRefs, onMounted, onBeforeUnmount } from 'vue';
import { useModal } from '@/composables/useModal';

const emit = defineEmits<{
  (e: 'close');
}>();

const props = defineProps<{
  open: boolean;
}>();

const { open } = toRefs(props);
const { modalOpen } = useModal();

function handleKeyboardEvent(ev: KeyboardEvent) {
  if (ev.code === 'Escape') emit('close');
}

onMounted(() => {
  document.addEventListener('keyup', handleKeyboardEvent);
});

onBeforeUnmount(() => {
  document.removeEventListener('keyup', handleKeyboardEvent);
});

watch(open, (val, prev) => {
  if (val !== prev) modalOpen.value = !modalOpen.value;
});
</script>

<template>
  <transition name="fade">
    <div v-if="open" class="modal mx-auto">
      <div class="backdrop" @click="$emit('close')" />
      <div class="shell overflow-hidden relative rounded-none md:rounded-lg">
        <div v-if="$slots.header" class="border-b py-3 text-center">
          <slot name="header" />
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="border-t p-4 text-center">
          <slot name="footer" />
        </div>
        <a class="absolute right-0 -top-1 p-4 text-color" @click="$emit('close')">
          <IH-x />
        </a>
      </div>
    </div>
  </transition>
</template>

<style lang="scss">
.modal {
  position: fixed;
  display: flex;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  align-items: center;
  justify-content: center;
  z-index: 40;

  .backdrop {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 99;
    background: rgba(0, 0, 0, 0.4);
  }

  .shell {
    border: 1px solid var(--border-color);
    background-color: var(--bg-color);
    padding-left: 0 !important;
    padding-right: 0 !important;
    max-width: 440px;
    overflow-y: auto !important;
    max-height: calc(100vh - 120px);
    display: flex;
    flex-direction: column;
    z-index: 999;
    margin: 0 auto;
    width: 100%;

    @media (max-width: 767px) {
      border: 0;
      width: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      min-height: 100% !important;
      margin-bottom: 0 !important;

      .modal-body {
        max-height: 100% !important;
      }
    }

    .modal-body {
      max-height: 420px;
      flex: auto;
      text-align: initial;
      overflow-y: auto;
      overflow-x: hidden;
    }
  }
}
</style>
