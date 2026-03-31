'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

import { useTheme } from '@/components/theme-provider'
import darkScreenshot from '../stardash_dark.png'
import lightScreenshot from '../stardash_light.png'

export function LandingHeroMedia() {
  const { resolvedTheme } = useTheme()

  const imageSrc = resolvedTheme === 'light' ? lightScreenshot : darkScreenshot
  const artifactClass =
    resolvedTheme === 'light'
      ? 'border-black/18 bg-black/[0.06]'
      : 'border-white/18 bg-white/[0.06]'
  const lineClass =
    resolvedTheme === 'light' ? 'bg-black/18' : 'bg-white/18'

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-6xl"
    >
      <div className="absolute inset-x-[10%] bottom-[-4%] h-20 rounded-full bg-black/10 blur-3xl dark:bg-black/35" />
      <div className={`absolute left-[-3%] top-[12%] hidden h-px w-[16%] lg:block ${lineClass}`} />
      <div className={`absolute right-[-3%] top-[20%] hidden h-px w-[18%] lg:block ${lineClass}`} />
      <div className={`absolute left-[5%] top-[-6%] hidden h-[18%] w-px lg:block ${lineClass}`} />
      <div className={`absolute right-[9%] bottom-[-6%] hidden h-[16%] w-px lg:block ${lineClass}`} />
      <div className={`absolute left-[6%] top-[16%] hidden h-4 w-4 rounded-full border lg:block ${artifactClass}`} />
      <div className={`absolute left-[8%] top-[18%] hidden h-px w-12 lg:block ${lineClass}`} />
      <div className={`absolute right-[10%] top-[24%] hidden h-3 w-14 rounded-full border lg:block ${artifactClass}`} />
      <div className={`absolute right-[10%] top-[24%] hidden h-8 w-px lg:block ${lineClass}`} />
      <div className={`absolute left-[15%] bottom-[10%] hidden h-3 w-3 rounded-full border lg:block ${artifactClass}`} />
      <div className={`absolute left-[15%] bottom-[10%] hidden h-px w-16 lg:block ${lineClass}`} />
      <div className={`absolute right-[18%] bottom-[14%] hidden h-5 w-5 rounded-sm border lg:block ${artifactClass}`} />
      <div className={`absolute right-[18%] bottom-[14%] hidden h-px w-10 lg:block ${lineClass}`} />

      <div className="relative overflow-hidden rounded-[28px] border border-black/10 bg-white/80 p-3 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-zinc-950/80 dark:shadow-[0_32px_90px_-42px_rgba(0,0,0,0.82)]">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[20px] bg-white dark:bg-zinc-950">
          <Image
            key={imageSrc.src}
            src={imageSrc}
            alt="StarDash dashboard preview"
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 80vw"
            className="object-cover object-top transition-opacity duration-300"
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/6 dark:ring-white/6" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.04),transparent_18%,transparent_82%,rgba(255,255,255,0.04))] dark:bg-[linear-gradient(to_top,rgba(0,0,0,0.12),transparent_22%,transparent_78%,rgba(255,255,255,0.03))]" />
        </div>
      </div>
    </motion.div>
  )
}
