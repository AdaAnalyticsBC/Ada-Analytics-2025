<script>
  import { ArrowRight, TrendingUp, Shield, Zap, BarChart3 } from 'lucide-svelte';
  
  const features = [
    {
      icon: TrendingUp,
      title: 'AI-Powered Trading',
      description: 'Advanced algorithms analyze market patterns and execute trades with precision.'
    },
    {
      icon: Shield,
      title: 'Risk Management',
      description: 'Built-in safeguards protect your portfolio with intelligent stop-loss and take-profit strategies.'
    },
    {
      icon: Zap,
      title: 'Real-Time Analytics',
      description: 'Monitor your portfolio performance with live charts and detailed analytics.'
    },
    {
      icon: BarChart3,
      title: 'Market Intelligence',
      description: 'Access comprehensive market data and insights to make informed decisions.'
    }
  ];
</script>

<svelte:head>
  <title>Ada Analytics - AI-Powered Trading Intelligence</title>
  <meta name="description" content="Advanced AI-powered trading platform with real-time analytics and risk management." />
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
  <!-- Hero Section -->
  <section class="relative overflow-hidden">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
      <div class="text-center">
        <h1 class="text-5xl md:text-7xl font-bold text-white mb-6">
          Ada Analytics
        </h1>
        <p class="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
          AI-Powered Trading Intelligence
        </p>
        <p class="text-lg text-gray-400 mb-12 max-w-2xl mx-auto">
          Advanced algorithms, real-time analytics, and intelligent risk management for modern traders.
        </p>
        
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a 
            href="https://dashboard.adaanalytics.io" 
            class="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 transform hover:scale-105"
          >
            Access Dashboard
            <ArrowRight class="ml-2 h-5 w-5" />
          </a>
          <a 
            href="#features" 
            class="inline-flex items-center px-8 py-4 border border-gray-600 text-gray-300 font-semibold rounded-lg hover:border-gray-500 hover:text-white transition-all duration-200"
          >
            Learn More
          </a>
        </div>
      </div>
    </div>
    
    <!-- Background Pattern -->
    <div class="absolute inset-0 opacity-10">
      <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h2 class="text-4xl font-bold text-white mb-4">
          Powerful Features
        </h2>
        <p class="text-xl text-gray-400 max-w-3xl mx-auto">
          Everything you need for intelligent, automated trading
        </p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {#each features as feature}
          <div class="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all duration-200">
            <div class="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center mb-4">
              <svelte:component this={feature.icon} class="h-6 w-6 text-white" />
            </div>
            <h3 class="text-xl font-semibold text-white mb-2">
              {feature.title}
            </h3>
            <p class="text-gray-400">
              {feature.description}
            </p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="py-20">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h2 class="text-4xl font-bold text-white mb-6">
        Ready to Start Trading?
      </h2>
      <p class="text-xl text-gray-400 mb-8">
        Join thousands of traders using AI-powered intelligence
      </p>
      <a 
        href="https://dashboard.adaanalytics.io" 
        class="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 transform hover:scale-105"
      >
        Get Started Now
        <ArrowRight class="ml-2 h-5 w-5" />
      </a>
    </div>
  </section>

  <!-- Footer -->
  <footer class="border-t border-white/10 py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center">
        <p class="text-gray-400">
          © 2024 Ada Analytics. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
</main>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }
</style> 