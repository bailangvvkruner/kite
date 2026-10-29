import { memo } from "react"
import { ArrowUUpLeftIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const Undo2Icon = memo((props: SvgProps) => <Glyph {...props} />)

Undo2Icon.displayName = "Undo2Icon"
