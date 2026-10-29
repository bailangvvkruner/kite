import { memo } from "react"
import { MagnifyingGlassIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const SearchIcon = memo((props: SvgProps) => <Glyph {...props} />)

SearchIcon.displayName = "SearchIcon"
