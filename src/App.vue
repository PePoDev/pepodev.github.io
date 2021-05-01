<template>
	<Banner />
	<Navbar />
</template>

<script lang="ts">
import Banner from "./components/Banner.vue";
import Navbar from "./components/Navbar.vue";

export default {
	components: { Banner, Navbar },
	setup() {
		return {};
	},
};
</script>
