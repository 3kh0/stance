<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 24 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" fill="none" aria-hidden="true" class="stance-logo shrink-0">
    <line class="stance-beam" x1="4.5" y1="12.5" x2="27.5" y2="19" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    <path d="M16 17 L23.5 28.5 H8.5 Z" fill="currentColor" />
  </svg>
</template>

<style>
.stance-beam {
  transform-box: view-box;
  transform-origin: 16px 15.75px;
  transition: transform 0.55s cubic-bezier(0.34, 1.3, 0.64, 1);
}
.stance-logo:hover .stance-beam,
.group:hover .stance-beam {
  transform: rotate(-31.57deg);
}

.stance-route-loading .stance-logo--header .stance-beam {
  animation: stance-logo-loading 560ms cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite alternate;
  will-change: transform;
}

@keyframes stance-logo-loading {
  from {
    transform: rotate(-18deg);
  }

  to {
    transform: rotate(18deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stance-beam {
    transition: none;
  }
  .stance-logo:hover .stance-beam,
  .group:hover .stance-beam {
    transform: none;
  }
  .stance-route-loading .stance-logo--header .stance-beam {
    animation: none;
  }
}
</style>
