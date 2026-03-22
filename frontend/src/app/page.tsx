import Link from 'next/link';
import { Zap, Globe, Code, Headset, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: Zap,
    title: 'Fast Delivery',
    description:
      'Orders start processing instantly with real-time status updates and rapid fulfillment.',
  },
  {
    icon: Globe,
    title: 'Multi-Platform',
    description: 'YouTube, Instagram, TikTok, Twitter, Facebook and more — all in one place.',
  },
  {
    icon: Code,
    title: 'API Access',
    description: 'Full REST API with webhooks for developers. Automate your workflow with ease.',
  },
  {
    icon: Headset,
    title: '24/7 Support',
    description: 'Our support team is always available to help you with any questions or issues.',
  },
];

const steps = [
  { number: 1, title: 'Register', description: 'Create your free account in seconds' },
  {
    number: 2,
    title: 'Fund Account',
    description: 'Add funds using your preferred payment method',
  },
  { number: 3, title: 'Place Orders', description: 'Choose a service and watch your growth' },
];

const stats = [
  { value: '1000+', label: 'Services' },
  { value: 'Instant', label: 'Delivery' },
  { value: '99.9%', label: 'Uptime' },
  { value: '24/7', label: 'Support' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">youboost</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 px-6 text-center bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-3xl mx-auto space-y-6">
          <Badge variant="secondary" className="text-sm px-4 py-1">
            #1 SMM Panel
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">YouBoost</h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Boost your social media presence with our premium services. Fast delivery, competitive
            prices, and reliable results.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button size="lg" asChild>
              <Link href="/register">
                Sign Up <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose YouBoost?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="text-center">
                <CardContent className="pt-6 space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="text-center space-y-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                  {step.number}
                </div>
                <h3 className="font-semibold text-lg">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center space-y-2">
                <div className="text-3xl sm:text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t py-8 px-6 bg-card">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold">youboost</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/register" className="hover:text-foreground transition-colors">
              Register
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Login
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} YouBoost. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
