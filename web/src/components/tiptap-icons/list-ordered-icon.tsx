import { memo } from "react"
import { ListNumbersIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const ListOrderedIcon = memo((props: SvgProps) => <Glyph {...props} />)

ListOrderedIcon.displayName = "ListOrderedIcon"
