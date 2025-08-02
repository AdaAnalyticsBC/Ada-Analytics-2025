<script lang="ts">
	import { 
		TrendingUp, 
		TrendingDown, 
		DollarSign, 
		BarChart3, 
		Settings, 
		Bell,
		RefreshCw,
		Eye,
		EyeOff,
		Plus,
		Minus,
		Activity,
		Target,
		Shield,
		Zap
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { onMount } from 'svelte';

	// Dashboard state
	let portfolioValue = 125000;
	let dailyChange = 2340;
	let dailyChangePercent = 1.91;
	let isPositive = dailyChange >= 0;
	let showSensitiveData = false;
	let isLoading = false;
	let lastUpdated = new Date();

	// Mock data for demonstration
	let positions = [
		{ symbol: 'AAPL', name: 'Apple Inc.', shares: 100, avgPrice: 150.25, currentPrice: 175.50, change: 25.25, changePercent: 16.8, value: 17550 },
		{ symbol: 'TSLA', name: 'Tesla Inc.', shares: 50, avgPrice: 200.00, currentPrice: 245.75, change: 45.75, changePercent: 22.9, value: 12287.50 },
		{ symbol: 'NVDA', name: 'NVIDIA Corp.', shares: 75, avgPrice: 300.00, currentPrice: 450.25, change: 150.25, changePercent: 50.1, value: 33768.75 },
		{ symbol: 'MSFT', name: 'Microsoft Corp.', shares: 200, avgPrice: 250.00, currentPrice: 280.50, change: 30.50, changePercent: 12.2, value: 56100 }
	];

	let recentTrades = [
		{ symbol: 'AAPL', type: 'BUY', shares: 25, price: 175.50, timestamp: new Date(Date.now() - 1000 * 60 * 30), status: 'completed' },
		{ symbol: 'TSLA', type: 'SELL', shares: 10, price: 245.75, timestamp: new Date(Date.now() - 1000 * 60 * 60), status: 'completed' },
		{ symbol: 'NVDA', type: 'BUY', shares: 15, price: 450.25, timestamp: new Date(Date.now() - 1000 * 60 * 90), status: 'pending' }
	];

	let alerts = [
		{ type: 'price', symbol: 'AAPL', message: 'Price target reached: $175.50', timestamp: new Date(Date.now() - 1000 * 60 * 15), read: false },
		{ type: 'volume', symbol: 'TSLA', message: 'Unusual volume detected', timestamp: new Date(Date.now() - 1000 * 60 * 45), read: false },
		{ type: 'news', symbol: 'NVDA', message: 'Earnings announcement scheduled', timestamp: new Date(Date.now() - 1000 * 60 * 120), read: true }
	];

	// AI Trading Bot Status
	let aiBotStatus = {
		active: true,
		performance: 12.5,
		tradesToday: 8,
		successRate: 87.5,
		lastSignal: 'AAPL - BUY signal at $175.50'
	};

	function refreshData() {
		isLoading = true;
		// Simulate API call
		setTimeout(() => {
			lastUpdated = new Date();
			isLoading = false;
		}, 1000);
	}

	function toggleSensitiveData() {
		showSensitiveData = !showSensitiveData;
	}

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function formatPercent(percent: number) {
		return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
	}

	function formatTimeAgo(date: Date) {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / (1000 * 60));
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'Just now';
	}

	onMount(() => {
		// Initialize dashboard data
		refreshData();
	});
</script>

<svelte:head>
	<title>Dashboard - Ada Analytics</title>
	<meta name="description" content="Trading dashboard with real-time analytics and AI-powered insights" />
</svelte:head>

<div class="min-h-screen bg-slate-50 dark:bg-slate-900">
	<!-- Header -->
	<header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
		<div class="container mx-auto px-4 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<div class="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
						<span class="text-white font-bold text-sm">A</span>
					</div>
					<h1 class="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
				</div>
				
				<div class="flex items-center space-x-4">
					<Button variant="outline" size="sm" onclick={toggleSensitiveData}>
						{#if showSensitiveData}
							<EyeOff class="w-4 h-4 mr-2" />
						{:else}
							<Eye class="w-4 h-4 mr-2" />
						{/if}
						{showSensitiveData ? 'Hide' : 'Show'} Sensitive Data
					</Button>
					
					<Button size="sm" onclick={refreshData} disabled={isLoading}>
						{#if isLoading}
							<RefreshCw class="w-4 h-4 mr-2 animate-spin" />
						{:else}
							<RefreshCw class="w-4 h-4 mr-2" />
						{/if}
						Refresh
					</Button>
					
					<Button variant="outline" size="sm">
						<Bell class="w-4 h-4 mr-2" />
						Alerts
					</Button>
					
					<Button variant="outline" size="sm">
						<Settings class="w-4 h-4 mr-2" />
						Settings
					</Button>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="container mx-auto px-4 py-8">
		<!-- Portfolio Overview -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="text-sm font-medium text-slate-600 dark:text-slate-400">Portfolio Value</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-slate-900 dark:text-white">
						{showSensitiveData ? formatCurrency(portfolioValue) : '••••••'}
					</div>
					<div class="flex items-center mt-1">
						{#if isPositive}
							<TrendingUp class="w-4 h-4 text-green-500 mr-1" />
						{:else}
							<TrendingDown class="w-4 h-4 text-red-500 mr-1" />
						{/if}
						<span class="text-sm {isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
							{formatCurrency(dailyChange)} ({formatPercent(dailyChangePercent)})
						</span>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="text-sm font-medium text-slate-600 dark:text-slate-400">Daily P&L</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-slate-900 dark:text-white">
						{showSensitiveData ? formatCurrency(dailyChange) : '••••••'}
					</div>
					<div class="text-sm text-slate-500 dark:text-slate-400 mt-1">
						Today's performance
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="text-sm font-medium text-slate-600 dark:text-slate-400">AI Bot Performance</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-slate-900 dark:text-white">
						{aiBotStatus.performance}%
					</div>
					<div class="text-sm text-slate-500 dark:text-slate-400 mt-1">
						{aiBotStatus.tradesToday} trades today
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="text-sm font-medium text-slate-600 dark:text-slate-400">Success Rate</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-slate-900 dark:text-white">
						{aiBotStatus.successRate}%
					</div>
					<div class="text-sm text-slate-500 dark:text-slate-400 mt-1">
						Last 30 days
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- AI Trading Bot Status -->
		<Card class="mb-8">
			<CardHeader>
				<CardTitle class="flex items-center">
					<Zap class="w-5 h-5 mr-2 text-purple-500" />
					AI Trading Bot
				</CardTitle>
				<CardDescription>
					Real-time AI-powered trading signals and automated execution
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div class="flex items-center space-x-4">
						<div class="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
							<Activity class="w-6 h-6 text-white" />
						</div>
						<div>
							<p class="font-semibold text-slate-900 dark:text-white">
								{aiBotStatus.active ? 'Active' : 'Inactive'}
							</p>
							<p class="text-sm text-slate-500 dark:text-slate-400">
								{aiBotStatus.lastSignal}
							</p>
						</div>
					</div>
					
					<div class="flex items-center space-x-4">
						<div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
							<Target class="w-6 h-6 text-white" />
						</div>
						<div>
							<p class="font-semibold text-slate-900 dark:text-white">
								{aiBotStatus.tradesToday} Trades
							</p>
							<p class="text-sm text-slate-500 dark:text-slate-400">
								Today's activity
							</p>
						</div>
					</div>
					
					<div class="flex items-center space-x-4">
						<div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
							<Shield class="w-6 h-6 text-white" />
						</div>
						<div>
							<p class="font-semibold text-slate-900 dark:text-white">
								{aiBotStatus.successRate}% Success
							</p>
							<p class="text-sm text-slate-500 dark:text-slate-400">
								Risk managed
							</p>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Positions and Recent Activity -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
			<!-- Positions -->
			<Card>
				<CardHeader>
					<CardTitle>Positions</CardTitle>
					<CardDescription>Current portfolio holdings and performance</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="space-y-4">
						{#each positions as position}
							<div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
								<div class="flex-1">
									<div class="flex items-center space-x-3">
										<div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
											<span class="text-white font-bold text-sm">{position.symbol[0]}</span>
										</div>
										<div>
											<p class="font-semibold text-slate-900 dark:text-white">{position.symbol}</p>
											<p class="text-sm text-slate-500 dark:text-slate-400">{position.name}</p>
										</div>
									</div>
								</div>
								<div class="text-right">
									<p class="font-semibold text-slate-900 dark:text-white">
										{showSensitiveData ? formatCurrency(position.value) : '••••••'}
									</p>
									<p class="text-sm {position.changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
										{formatPercent(position.changePercent)}
									</p>
								</div>
							</div>
						{/each}
					</div>
				</CardContent>
			</Card>

			<!-- Recent Trades -->
			<Card>
				<CardHeader>
					<CardTitle>Recent Trades</CardTitle>
					<CardDescription>Latest trading activity and orders</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="space-y-4">
						{#each recentTrades as trade}
							<div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
								<div class="flex-1">
									<div class="flex items-center space-x-3">
										<div class="w-8 h-8 rounded-full flex items-center justify-center {trade.type === 'BUY' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}">
											{#if trade.type === 'BUY'}
												<Plus class="w-4 h-4 text-green-600 dark:text-green-400" />
											{:else}
												<Minus class="w-4 h-4 text-red-600 dark:text-red-400" />
											{/if}
										</div>
										<div>
											<p class="font-semibold text-slate-900 dark:text-white">{trade.symbol}</p>
											<p class="text-sm text-slate-500 dark:text-slate-400">
												{trade.shares} shares @ {formatCurrency(trade.price)}
											</p>
										</div>
									</div>
								</div>
								<div class="text-right">
									<Badge variant={trade.status === 'completed' ? 'default' : 'secondary'}>
										{trade.status}
									</Badge>
									<p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
										{formatTimeAgo(trade.timestamp)}
									</p>
								</div>
							</div>
						{/each}
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Alerts -->
		<Card class="mt-8">
			<CardHeader>
				<CardTitle>Alerts & Notifications</CardTitle>
				<CardDescription>Real-time market alerts and trading signals</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="space-y-4">
					{#each alerts as alert}
						<div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg {!alert.read ? 'border-l-4 border-purple-500' : ''}">
							<div class="flex items-center space-x-3">
								<div class="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
									<Bell class="w-4 h-4 text-white" />
								</div>
								<div>
									<p class="font-semibold text-slate-900 dark:text-white">{alert.message}</p>
									<p class="text-sm text-slate-500 dark:text-slate-400">
										{alert.symbol} • {formatTimeAgo(alert.timestamp)}
									</p>
								</div>
							</div>
							{#if !alert.read}
								<Badge variant="secondary">New</Badge>
							{/if}
						</div>
					{/each}
				</div>
			</CardContent>
		</Card>
	</main>
</div>

<style>
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style> 