import { memo } from "react"
import { ListBulletsIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const ListIcon = memo((props: SvgProps) => <Glyph {...props} />)

ListIcon.displayName = "ListIcon"
