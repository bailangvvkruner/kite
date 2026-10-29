import { memo } from "react"
import { CaretDownIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const ChevronDownIcon = memo((props: SvgProps) => <Glyph {...props} />)

ChevronDownIcon.displayName = "ChevronDownIcon"
