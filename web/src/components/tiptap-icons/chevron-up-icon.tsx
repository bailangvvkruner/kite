import { memo } from "react"
import { CaretUpIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const ChevronUpIcon = memo((props: SvgProps) => <Glyph {...props} />)

ChevronUpIcon.displayName = "ChevronUpIcon"
