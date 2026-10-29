import { memo } from "react"
import { ListChecksIcon as Glyph } from "@phosphor-icons/react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

// Kite: Phosphor's glyph, as every icon in the studio is.
export const ListTodoIcon = memo((props: SvgProps) => <Glyph {...props} />)

ListTodoIcon.displayName = "ListTodoIcon"
