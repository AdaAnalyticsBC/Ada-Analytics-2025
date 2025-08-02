<script lang="ts">
	import { onMount } from 'svelte';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { TrendingUp, TrendingDown, Activity, Target, BarChart3 } from 'lucide-svelte';

	let performance: any = null;
	let loading = true;
	let error = '';

	onMount(async () => {
		try {
			const response = await fetch('/api/performance');
			if (response.ok) {
				performance = await response.json();
			} else {
				error = 'Failed to load performance data';
			}
		} catch (err) {
			error = 'Error loading performance data';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Performance - Ada Analytics Dashboard</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">Trading Performance</h1>
		<p class="text-slate-600 dark:text-slate-400">Comprehensive analysis of your trading performance over the last 90 days</p>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
		</div>
	{:else if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200">{error}</p>
		</div>
	{:else if performance}
		<!-- Key Metrics -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Total Trades</CardTitle>
					<Activity class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold">{performance.total_trades}</div>
					<p class="text-xs text-muted-foreground">Last 90 days</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Win Rate</CardTitle>
					<Target class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold {(performance.win_rate * 100) > 50 ? 'text-green-600' : 'text-red-600'}">
						{(performance.win_rate * 100).toFixed(1)}%
					</div>
					<p class="text-xs text-muted-foreground">Successful trades</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Avg Return</CardTitle>
					<TrendingUp class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold {performance.avg_return > 0 ? 'text-green-600' : 'text-red-600'}">
						{(performance.avg_return * 100).toFixed(2)}%
					</div>
					<p class="text-xs text-muted-foreground">Per trade</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium">Total Return</CardTitle>
					<BarChart3 class="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold {performance.total_return > 0 ? 'text-green-600' : 'text-red-600'}">
						{(performance.total_return * 100).toFixed(2)}%
					</div>
					<p class="text-xs text-muted-foreground">Overall performance</p>
				</CardContent>
			</Card>
		</div>

		<!-- Symbols Traded -->
		<Card class="mb-8">
			<CardHeader>
				<CardTitle>Symbols Traded</CardTitle>
				<CardDescription>All symbols traded in the last 90 days</CardDescription>
			</CardHeader>
			<CardContent>
				{#if performance.symbols_traded && performance.symbols_traded.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each performance.symbols_traded as symbol}
							<Badge variant="secondary">{symbol}</Badge>
						{/each}
					</div>
				{:else}
					<p class="text-muted-foreground">No trades recorded yet</p>
				{/if}
			</CardContent>
		</Card>

		<!-- Recent Trades -->
		<Card>
			<CardHeader>
				<CardTitle>Recent Trades</CardTitle>
				<CardDescription>Latest trades from the last 90 days</CardDescription>
			</CardHeader>
			<CardContent>
				{#if performance.recent_trades && performance.recent_trades.length > 0}
					<div class="space-y-4">
						{#each performance.recent_trades as trade}
							<div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
								<div class="flex items-center space-x-4">
									<div class="flex items-center space-x-2">
										{#if trade.action === 'BUY'}
											<TrendingUp className="h-4 w-4 text-green-600" />
										{:else}
											<TrendingDown className="h-4 w-4 text-red-600" />
										{/if}
										<span class="font-semibold">{trade.symbol}</span>
									</div>
									<div class="text-sm text-muted-foreground">
										{trade.action} {trade.quantity} shares
									</div>
								</div>
								<div class="text-right">
									<div class="font-semibold">${trade.price_target?.toFixed(2) || 'N/A'}</div>
									<div class="text-sm text-muted-foreground">
										{new Date(trade.executed_at).toLocaleDateString()}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-muted-foreground">No recent trades to display</p>
				{/if}
			</CardContent>
		</Card>
	{/if}
</div> 