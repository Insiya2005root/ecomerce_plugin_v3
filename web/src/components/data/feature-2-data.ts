import { Clock, Heart, Users, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface FeatureItem {
  icon: LucideIcon
  title: string
  description: string
}

export const features: FeatureItem[] = [
  {
    icon: Heart,
    title: 'Quality Assurance',
    description:
      'Every product in our catalog undergoes rigorous quality checks to meet the highest standards of excellence and performance.',
  },
  {
    icon: Zap,
    title: 'Fast Service',
    description:
      'Experience lightning-fast order processing and delivery with our advanced logistics network and efficient service protocols.',
  },
  {
    icon: Clock,
    title: 'Timely Updates',
    description:
      'Get real-time notifications and detailed tracking for all your orders, keeping you informed throughout the delivery process.',
  },
  {
    icon: Users,
    title: 'Expert Team',
    description:
      'Our team of dedicated professionals is available 24/7 to assist you with personalized support and expert advice.',
  },
]