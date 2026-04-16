import Image from "next/image"

interface DragonIconProps {
  className?: string
}

export function DragonIcon({ className }: DragonIconProps) {
  return (
    <Image
      src="/images/dragon-icon.png"
      alt=""
      width={24}
      height={24}
      className={className}
      loading="eager"
    />
  )
}
