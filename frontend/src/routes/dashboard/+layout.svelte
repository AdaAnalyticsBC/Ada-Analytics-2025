<script lang="ts">
	import '../../app.css';
	import { 
		BarChart3, 
		TrendingUp, 
		Settings, 
		Bell, 
		User, 
		LogOut,
		Home,
		Zap,
		Shield,
		Activity
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	const navigation = [
		{ href: '/', label: 'Home', icon: Home },
		{ href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
		{ href: '/dashboard/performance', label: 'Performance', icon: TrendingUp },
		{ href: '/dashboard/trades', label: 'Trade History', icon: Activity },
		{ href: '/dashboard/ai-bot', label: 'AI Bot', icon: Zap },
		{ href: '/dashboard/analytics', label: 'Analytics', icon: Activity },
		{ href: '/dashboard/settings', label: 'Settings', icon: Settings }
	];
</script>

<svelte:head>
	<title>Dashboard - Ada Analytics</title>
	<meta name="description" content="Trading dashboard with real-time analytics and AI-powered insights" />
</svelte:head>

<div class="min-h-screen bg-slate-50 dark:bg-slate-900">
	<!-- Top Navigation -->
	<nav class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
		<div class="container mx-auto px-4">
			<div class="flex items-center justify-between h-16">
				<!-- Logo -->
				<div class="flex items-center space-x-2">
					<div class="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
						<span class="text-white font-bold text-sm">A</span>
					</div>
					<span class="text-xl font-bold text-slate-900 dark:text-white">Ada Analytics</span>
				</div>
				
				<!-- Right side actions -->
				<div class="flex items-center space-x-4">
					<Button variant="outline" size="sm">
						<Bell class="w-4 h-4 mr-2" />
						Alerts
					</Button>
					<Button variant="outline" size="sm">
						<User class="w-4 h-4 mr-2" />
						Account
					</Button>
					<Button variant="outline" size="sm">
						<LogOut class="w-4 h-4 mr-2" />
						Logout
					</Button>
				</div>
			</div>
		</div>
	</nav>

	<div class="flex">
		<!-- Sidebar -->
		<aside class="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 min-h-screen">
			<nav class="p-4">
				<ul class="space-y-2">
					{#each navigation as item}
						<li>
							<a 
								href={item.href}
								class="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors {item.href === '/dashboard' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : ''}"
							>
								<svelte:component this={item.icon} class="w-5 h-5" />
								<span>{item.label}</span>
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</aside>

		<!-- Main Content -->
		<main class="flex-1">
			<slot />
		</main>
	</div>
</div>

<style>
	/* Custom scrollbar for sidebar */
	aside nav {
		scrollbar-width: thin;
		scrollbar-color: rgb(148 163 184) transparent;
	}
	
	aside nav::-webkit-scrollbar {
		width: 6px;
	}
	
	aside nav::-webkit-scrollbar-track {
		background: transparent;
	}
	
	aside nav::-webkit-scrollbar-thumb {
		background-color: rgb(148 163 184);
		border-radius: 3px;
	}
</style> 