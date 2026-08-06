<template>
  <div class="phone-number-input">
    <ion-item lines="full">
      <ion-select
        v-model="countryCode"
        interface="popover"
        label="Country"
        label-placement="stacked"
        class="country-select"
        aria-label="Country"
      >
        <ion-select-option
          v-for="country in PHONE_COUNTRIES"
          :key="country.code"
          :value="country.code"
        >
          {{ country.flag }} {{ country.name }} (+{{ country.dialCode }})
        </ion-select-option>
      </ion-select>
    </ion-item>

    <ion-item lines="full">
      <ion-input
        v-model="nationalNumber"
        type="tel"
        label="Phone number"
        label-placement="stacked"
        :placeholder="selectedCountry?.placeholder ?? 'Phone number'"
        autocomplete="tel-national"
        inputmode="tel"
        :required="required"
      />
    </ion-item>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonInput, IonItem, IonSelect, IonSelectOption } from '@ionic/vue';

import { PHONE_COUNTRIES } from '@/data/phoneCountries';
import {
  buildE164PhoneNumber,
  getPhoneCountry,
  guessDefaultCountryCode,
  parseE164PhoneNumber,
} from '@/utils/phoneNumber';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    required?: boolean;
  }>(),
  {
    modelValue: '',
    required: true,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const countryCode = ref(guessDefaultCountryCode());
const nationalNumber = ref('');

const selectedCountry = computed(() => getPhoneCountry(countryCode.value));

function applyModelValue(value: string) {
  if (!value) {
    return;
  }

  const parsed = parseE164PhoneNumber(value);
  if (parsed) {
    countryCode.value = parsed.countryCode;
    nationalNumber.value = parsed.nationalNumber;
    return;
  }

  nationalNumber.value = value.replace(/^\+/, '');
}

function syncModelValue() {
  const e164 = buildE164PhoneNumber(countryCode.value, nationalNumber.value) ?? '';
  if (e164 !== props.modelValue) {
    emit('update:modelValue', e164);
  }
}

watch(
  () => props.modelValue,
  (value) => {
    const current = buildE164PhoneNumber(countryCode.value, nationalNumber.value) ?? '';
    if (value && value !== current) {
      applyModelValue(value);
    }
  },
  { immediate: true },
);

watch([countryCode, nationalNumber], syncModelValue);

defineExpose({
  countryCode,
});
</script>

<style scoped>
.phone-number-input {
  margin-bottom: 0.25rem;
}

.country-select {
  width: 100%;
  max-width: 100%;
}
</style>
