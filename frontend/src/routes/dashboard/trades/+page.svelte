<script lang="ts">
	import { onMount } from 'svelte';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-svelte';

	let trades: any[] = [];
	let loading = true;
	let error = '';

	onMount(async () => {
		try {
			const response = await fetch('/api/trades?days=30');
			if (response.ok) {
				trades = await response.json();
			} else {
				error = 'Failed to load trade data';
			}
		} catch (err) {
			error = 'Error loading trade data';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Trade History - Ada Analytics Dashboard</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">Trade History</h1>
		<p class="text-slate-600 dark:text-slate-400">Detailed view of all trades from the last 30 days</p>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
		</div>
	{:else if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200">{error}</p>
		</div>
	{:else}
		<Card>
			<CardHeader>
				<CardTitle>Trade History (30 days)</CardTitle>
				<CardDescription>All executed trades and their details</CardDescription>
			</CardHeader>
			<CardContent>
				{#if trades.length > 0}
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead>
								<tr class="border-b border-slate-200 dark:border-slate-700">
									<th class="text-left py-3 px-4 font-semibold">Date</th>
									<th class="text-left py-3 px-4 font-semibold">Symbol</th>
									<th class="text-left py-3 px-4 font-semibold">Action</th>
									<th class="text-left py-3 px-4 font-semibold">Quantity</th>
									<th class="text-left py-3 px-4 font-semibold">Target Price</th>
									<th class="text-left py-3 px-4 font-semibold">Executed Price</th>
									<th class="text-left py-3 px-4 font-semibold">Confidence</th>
									<th class="text-left py-3 px-4 font-semibold">Status</th>
								</tr>
							</thead>
							<tbody>
								{#each trades as trade}
									<tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
										<td class="py-3 px-4">
											<div class="flex items-center space-x-2">
												<Calendar class="h-4 w-4 text-slate-400" />
												<span>{new Date(trade.executed_at).toLocaleDateString()}</span>
											</div>
										</td>
										<td class="py-3 px-4">
											<span class="font-semibold">{trade.symbol}</span>
										</td>
										<td class="py-3 px-4">
											<div class="flex items-center space-x-2">
												{#if trade.action === 'BUY'}
													<TrendingUp class="h-4 w-4 text-green-600" />
												{:else}
													<TrendingDown class="h-4 w-4 text-red-600" />
												{/if}
												<span>{trade.action}</span>
											</div>
										</td>
										<td class="py-3 px-4">{trade.quantity}</td>
										<td class="py-3 px-4">
											<div class="flex items-center space-x-1">
												<DollarSign class="h-4 w-4 text-slate-400" />
												<span>${trade.price_target?.toFixed(2) || 'N/A'}</span>
											</div>
										</td>
										<td class="py-3 px-4">
											<div class="flex items-center space-x-1">
												<DollarSign class="h-4 w-4 text-slate-400" />
												<span>${trade.executed_price?.toFixed(2) || 'Pending'}</span>
											</div>
										</td>
										<td class="py-3 px-4">
											<Badge variant={trade.confidence > 0.7 ? 'default' : trade.confidence > 0.5 ? 'secondary' : 'outline'}>
												{((trade.confidence || 0) * 100).toFixed(0)}%
											</Badge>
										</td>
										<td class="py-3 px-4">
											<Badge variant={trade.status === 'executed' ? 'default' : 'secondary'}>
												{trade.status}
											</Badge>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="text-center py-12">
						<p class="text-slate-500 dark:text-slate-400">No trades found in the last 30 days.</p>
					</div>
				{/if}
			</CardContent>
		</Card>
	{/if}
</div> 