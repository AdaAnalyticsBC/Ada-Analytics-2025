<script lang="ts">
	import '../app.css';
	import { Menu, X, ArrowUp } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	
	let mobileMenuOpen = false;
	
	const navItems = [
		{ href: '#features', label: 'Features' },
		{ href: '#testimonials', label: 'Testimonials' },
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '#pricing', label: 'Pricing' }
	];
	
	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<svelte:head>
	<title>Ada Analytics - AI-Powered Trading Platform</title>
	<meta name="description" content="Advanced AI-powered trading platform with real-time analytics, risk management, and automated trading strategies." />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<!-- Navigation -->
<nav class="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700">
	<div class="container mx-auto px-4">
		<div class="flex items-center justify-between h-16">
			<!-- Logo -->
			<div class="flex items-center space-x-2 animate-fade-in-left">
				<div class="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
					<span class="text-white font-bold text-sm">A</span>
				</div>
				<span class="text-xl font-bold text-slate-900 dark:text-white">Ada Analytics</span>
			</div>
			
			<!-- Desktop Navigation -->
			<div class="hidden md:flex items-center space-x-8">
				{#each navItems as item}
					<a 
						href={item.href}
						class="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
					>
						{item.label}
					</a>
				{/each}
				<Button variant="outline" size="sm">
					Sign In
				</Button>
				<a href="/dashboard">
					<Button size="sm" class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
						Get Started
					</Button>
				</a>
			</div>
			
			<!-- Mobile menu button -->
			<button
				class="md:hidden p-2 rounded-md text-white hover:bg-white/10 transition-colors"
				onclick={() => mobileMenuOpen = !mobileMenuOpen}
				aria-label="Toggle mobile menu"
			>
				<Menu class="w-6 h-6" />
			</button>
		</div>
		
		<!-- Mobile menu -->
		{#if mobileMenuOpen}
			<div class="md:hidden fixed inset-0 z-50">
				<!-- Backdrop -->
				<div 
					class="absolute inset-0 bg-black/50 backdrop-blur-sm"
					onclick={() => mobileMenuOpen = false}
					onkeydown={(e) => e.key === 'Escape' && (mobileMenuOpen = false)}
					role="button"
					tabindex="0"
					aria-label="Close mobile menu"
				></div>
				<div class="md:hidden py-4 border-t border-slate-200 dark:border-slate-700 animate-slide-down">
					<div class="flex flex-col space-y-4">
						{#each navItems as item}
							<a 
								href={item.href}
								class="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
								onclick={() => mobileMenuOpen = false}
							>
								{item.label}
							</a>
						{/each}
						<div class="flex flex-col space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
							<Button variant="outline" size="sm" class="w-full">
								Sign In
							</Button>
							<a href="/dashboard" class="w-full">
								<Button size="sm" class="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
									Get Started
								</Button>
							</a>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</nav>

<!-- Main Content -->
<main class="pt-16">
	<slot />
</main>

<!-- Footer -->
<footer class="bg-slate-900 text-white py-16">
	<div class="container mx-auto px-4">
		<div class="grid md:grid-cols-4 gap-8">
			<!-- Company Info -->
			<div class="md:col-span-2">
				<div class="flex items-center space-x-2 mb-4">
					<div class="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
						<span class="text-white font-bold text-sm">A</span>
					</div>
					<span class="text-xl font-bold">Ada Analytics</span>
				</div>
				<p class="text-slate-400 mb-6 max-w-md">
					Advanced AI-powered trading platform with real-time analytics, risk management, and automated trading strategies.
				</p>
				<div class="flex space-x-4">
					<Badge variant="secondary" class="bg-slate-800 text-slate-300">
						AI-Powered
					</Badge>
					<Badge variant="secondary" class="bg-slate-800 text-slate-300">
						Real-time
					</Badge>
					<Badge variant="secondary" class="bg-slate-800 text-slate-300">
						Secure
					</Badge>
				</div>
			</div>
			
			<!-- Quick Links -->
			<div>
				<h3 class="text-lg font-semibold mb-4">Product</h3>
				<ul class="space-y-2 text-slate-400">
					<li><a href="#features" class="hover:text-white transition-colors">Features</a></li>
					<li><a href="/dashboard" class="hover:text-white transition-colors">Dashboard</a></li>
					<li><a href="#pricing" class="hover:text-white transition-colors">Pricing</a></li>
					<li><a href="/api" class="hover:text-white transition-colors">API</a></li>
				</ul>
			</div>
			
			<!-- Support -->
			<div>
				<h3 class="text-lg font-semibold mb-4">Support</h3>
				<ul class="space-y-2 text-slate-400">
					<li><a href="/docs" class="hover:text-white transition-colors">Documentation</a></li>
					<li><a href="/help" class="hover:text-white transition-colors">Help Center</a></li>
					<li><a href="/contact" class="hover:text-white transition-colors">Contact</a></li>
					<li><a href="/status" class="hover:text-white transition-colors">Status</a></li>
				</ul>
			</div>
		</div>
		
		<div class="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
			<p class="text-slate-400 text-sm">
				© 2024 Ada Analytics. All rights reserved.
			</p>
			<div class="flex space-x-6 mt-4 md:mt-0">
				<a href="/privacy" class="text-slate-400 hover:text-white transition-colors text-sm">Privacy</a>
				<a href="/terms" class="text-slate-400 hover:text-white transition-colors text-sm">Terms</a>
				<a href="/cookies" class="text-slate-400 hover:text-white transition-colors text-sm">Cookies</a>
			</div>
		</div>
	</div>
</footer>

<!-- Scroll to top button -->
<button
	onclick={scrollToTop}
	class="fixed bottom-8 right-8 w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 animate-fade-in-delayed"
>
	<ArrowUp class="w-5 h-5" />
</button>

<style>
	@keyframes fade-in-left {
		from { 
			opacity: 0; 
			transform: translateX(-20px);
		}
		to { 
			opacity: 1; 
			transform: translateX(0);
		}
	}
	
	@keyframes slide-down {
		from { 
			opacity: 0; 
			height: 0;
		}
		to { 
			opacity: 1; 
			height: auto;
		}
	}
	
	@keyframes fade-in-delayed {
		from { 
			opacity: 0; 
			transform: scale(0);
		}
		to { 
			opacity: 1; 
			transform: scale(1);
		}
	}
	
	.animate-fade-in-left {
		animation: fade-in-left 0.5s ease-out;
	}
	
	.animate-slide-down {
		animation: slide-down 0.3s ease-out;
	}
	
	.animate-fade-in-delayed {
		animation: fade-in-delayed 0.5s ease-out 1s forwards;
		opacity: 0;
	}
</style>
