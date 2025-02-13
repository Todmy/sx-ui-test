<script setup lang="ts">
import { ref, computed, Ref } from 'vue';
import type { StrategyConfig, StrategyTemplate } from '@/networks/types';

const props = defineProps<{
  modelValue: StrategyConfig[];
  title: string;
  description: string;
  availableStrategies: StrategyTemplate[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: StrategyConfig[]);
}>();

const activeStrategies = computed({
  get: () => props.modelValue,
  set: newValue => emit('update:modelValue', newValue)
});

const editedStrategy: Ref<StrategyConfig | null> = ref(null);
const editStrategyModalOpen = ref(false);

function addStrategy(strategy: StrategyTemplate) {
  const strategyConfig = {
    id: crypto.randomUUID(),
    params: {},
    ...strategy
  };

  if (strategy.paramsDefinition) {
    editStrategy(strategyConfig);
  } else {
    activeStrategies.value = [...activeStrategies.value, strategyConfig];
  }
}

function editStrategy(strategy: StrategyConfig) {
  editedStrategy.value = strategy;
  editStrategyModalOpen.value = true;
}

function removeStrategy(strategy: StrategyConfig) {
  activeStrategies.value = activeStrategies.value.filter(s => s.id !== strategy.id);
}

function handleStrategySave(value: Record<string, any>) {
  editStrategyModalOpen.value = false;

  let allStrategies = [...activeStrategies.value];
  if (editedStrategy.value && !allStrategies.find(s => s.id === editedStrategy.value?.id)) {
    allStrategies.push(editedStrategy.value);
  }

  activeStrategies.value = allStrategies.map(strategy => {
    if (strategy.id !== editedStrategy.value?.id) return strategy;

    return {
      ...strategy,
      params: value
    };
  });
}
</script>

<template>
  <div>
    <div class="mb-4">
      <h3 class="mb-2">{{ title }}</h3>
      <span class="mb-3 inline-block">
        {{ description }}
      </span>
      <h4 class="eyebrow mb-2">Active</h4>
      <div class="mb-3">
        <div v-if="activeStrategies.length === 0">No strategies selected</div>
        <div
          v-for="strategy in activeStrategies"
          v-else
          :key="strategy.id"
          class="flex justify-between items-center rounded-lg border px-4 py-3 mb-3 text-skin-link"
        >
          <div class="flex min-w-0">
            <div class="whitespace-nowrap">{{ strategy.name }}</div>
            <div v-if="strategy.generateSummary" class="ml-2 pr-2 text-skin-text truncate">
              {{ strategy.generateSummary(strategy.params) }}
            </div>
          </div>
          <div class="flex gap-3">
            <a v-if="strategy.paramsDefinition" @click="editStrategy(strategy)">
              <IH-pencil />
            </a>
            <a @click="removeStrategy(strategy)">
              <IH-trash />
            </a>
          </div>
        </div>
      </div>
      <h4 class="eyebrow mb-2">Available</h4>
      <div v-if="availableStrategies.length === 0">No strategies available</div>
      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="strategy in availableStrategies"
          :key="strategy.address"
          class="flex items-center rounded-lg border cursor-pointer px-3 py-2 text-skin-link"
          @click="addStrategy(strategy)"
        >
          <IH-plus-circle />
          <div class="ml-2">{{ strategy.name }}</div>
        </button>
      </div>
    </div>
    <teleport to="#modal">
      <ModalEditStrategy
        :open="editStrategyModalOpen"
        :definition="editedStrategy?.paramsDefinition"
        :initial-state="editedStrategy?.params"
        @close="editStrategyModalOpen = false"
        @save="handleStrategySave"
      />
    </teleport>
  </div>
</template>
