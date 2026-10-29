import { memo } from "react"
import { ArrowLeftIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const ArrowLeftIcon = memo((props: SvgProps) => <Glyph {...props} />)

ArrowLeftIcon.displayName = "ArrowLeftIcon"
