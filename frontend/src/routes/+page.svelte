<script lang="ts">
	import { 
		TrendingUp, 
		Shield, 
		Zap, 
		BarChart3, 
		ArrowRight, 
		Play,
		Star,
		Users,
		CheckCircle
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';

	const features = [
		{
			icon: TrendingUp,
			title: 'AI-Powered Trading',
			description: 'Advanced algorithms analyze market patterns in real-time for optimal trading decisions.'
		},
		{
			icon: Shield,
			title: 'Risk Management',
			description: 'Built-in risk controls and portfolio protection to safeguard your investments.'
		},
		{
			icon: Zap,
			title: 'Lightning Fast',
			description: 'Ultra-low latency execution for capturing market opportunities instantly.'
		},
		{
			icon: BarChart3,
			title: 'Advanced Analytics',
			description: 'Comprehensive insights and performance metrics to track your success.'
		}
	];

	const testimonials = [
		{
			name: 'Sarah Chen',
			role: 'Portfolio Manager',
			content: 'Ada Analytics transformed our trading strategy. The AI insights are invaluable.',
			rating: 5
		},
		{
			name: 'Michael Rodriguez',
			role: 'Day Trader',
			content: 'The real-time alerts and risk management features give me confidence in every trade.',
			rating: 5
		},
		{
			name: 'Emily Watson',
			role: 'Investment Advisor',
			content: 'Finally, a platform that combines sophisticated analytics with user-friendly design.',
			rating: 5
		}
	];
</script>


<svelte:head>
	<title>Ada Analytics - AI-Powered Trading Platform</title>
	<meta name="description" content="Advanced AI-powered trading platform with real-time analytics, risk management, and automated trading strategies." />
</svelte:head>

<!-- Hero Section -->
<section class="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
	<!-- Animated background elements -->
	<div class="absolute inset-0 flex items-center justify-center">
		<div class="w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
	</div>
	
	<div class="container mx-auto px-4 text-center relative z-10">
		<div class="animate-fade-in">
			<Badge variant="secondary" class="mb-4">
				<Zap class="w-4 h-4 mr-2" />
				AI-Powered Trading Platform
			</Badge>
			
			<h1 class="text-5xl md:text-7xl font-bold text-white mb-6">
				Trade Smarter with
				<span class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
					AI Intelligence
				</span>
			</h1>
			
			<p class="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto">
				Advanced algorithms, real-time analytics, and automated trading strategies. 
				Experience the future of trading with Ada Analytics.
			</p>
			
			<div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
				<a href="/dashboard">
					<Button size="lg" class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
						Get Started Free
						<ArrowRight class="w-5 h-5 ml-2" />
					</Button>
				</a>
				<Button variant="outline" size="lg" class="border-white/20 text-white hover:bg-white/10">
					<Play class="w-5 h-5 mr-2" />
					Watch Demo
				</Button>
			</div>
		</div>
	</div>
</section>

<!-- Features Section -->
<section class="py-20 bg-slate-50 dark:bg-slate-900">
	<div class="container mx-auto px-4">
		<div class="text-center mb-16">
			<h2 class="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
				Why Choose Ada Analytics?
			</h2>
			<p class="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
				Cutting-edge technology meets intuitive design for the ultimate trading experience.
			</p>
		</div>
		
		<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
			{#each features as feature, index}
				<div class="animate-fade-in-up" style="animation-delay: {index * 0.1}s;">
					<Card class="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white dark:bg-slate-800">
						<CardHeader class="text-center">
							<div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4">
								<svelte:component this={feature.icon} class="w-8 h-8 text-white" />
							</div>
							<CardTitle class="text-xl">{feature.title}</CardTitle>
						</CardHeader>
						<CardContent>
							<CardDescription class="text-center text-slate-600 dark:text-slate-400">
								{feature.description}
							</CardDescription>
						</CardContent>
					</Card>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Testimonials Section -->
<section class="py-20 bg-white dark:bg-slate-800">
	<div class="container mx-auto px-4">
		<div class="text-center mb-16">
			<h2 class="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
				Trusted by Traders Worldwide
			</h2>
			<p class="text-xl text-slate-600 dark:text-slate-400">
				See what our users have to say about their experience.
			</p>
		</div>
		
		<div class="grid md:grid-cols-3 gap-8">
			{#each testimonials as testimonial, index}
				<div class="animate-fade-in-up" style="animation-delay: {index * 0.1}s;">
					<Card class="h-full border-0 shadow-lg bg-slate-50 dark:bg-slate-700">
						<CardContent class="pt-6">
							<div class="flex items-center mb-4">
								{#each Array(testimonial.rating) as _, i}
									<Star class="w-5 h-5 text-yellow-400 fill-current" />
								{/each}
							</div>
							<p class="text-slate-600 dark:text-slate-300 mb-4 italic">
								"{testimonial.content}"
							</p>
							<div class="flex items-center">
								<div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-3">
									<Users class="w-5 h-5 text-white" />
								</div>
								<div>
									<p class="font-semibold text-slate-900 dark:text-white">{testimonial.name}</p>
									<p class="text-sm text-slate-500 dark:text-slate-400">{testimonial.role}</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- CTA Section -->
<section class="py-20 bg-gradient-to-r from-purple-600 to-pink-600">
	<div class="container mx-auto px-4 text-center">
		<div class="animate-fade-in">
			<h2 class="text-4xl md:text-5xl font-bold text-white mb-6">
				Ready to Transform Your Trading?
			</h2>
			<p class="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
				Join thousands of traders who are already using Ada Analytics to make smarter, more profitable decisions.
			</p>
			<div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
				<a href="/dashboard">
					<Button size="lg" variant="secondary" class="bg-white text-purple-600 hover:bg-slate-100">
						Start Free Trial
						<ArrowRight class="w-5 h-5 ml-2" />
					</Button>
				</a>
				<Button size="lg" variant="outline" class="border-white/20 text-white hover:bg-white/10">
					Schedule Demo
				</Button>
			</div>
		</div>
	</div>
</section>

<style>
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	
	@keyframes fade-in-up {
		from { 
			opacity: 0; 
			transform: translateY(30px);
		}
		to { 
			opacity: 1; 
			transform: translateY(0);
		}
	}
	
	.animate-fade-in {
		animation: fade-in 0.8s ease-out;
	}
	
	.animate-fade-in-up {
		animation: fade-in-up 0.6s ease-out forwards;
		opacity: 0;
	}
</style>
