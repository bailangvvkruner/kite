import { memo } from "react"
import { ArrowUUpRightIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const Redo2Icon = memo((props: SvgProps) => <Glyph {...props} />)

Redo2Icon.displayName = "Redo2Icon"
