import { Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

function renderNode(node, props) {
  const key = `${props.kindPrefix}:${node.id}`;
  const collapsed = !!props.collapsedGroups[key];
  const indent = node.depth * 20;
  return (
    <Fragment key={key}>
      <TableRow
        className="cursor-pointer bg-muted/40 hover:bg-muted/60"
        onClick={() => props.toggleGroup(key)}
        data-testid={`${props.kindPrefix}-group-row-${node.id}`}
      >
        <TableCell colSpan={props.colSpan}>
          <div className="flex items-center gap-2 font-bold" style={{ paddingLeft: indent }}>
            {props.groupSelection && (
              <Checkbox
                checked={props.groupSelection.isSelected(node)}
                onCheckedChange={(v) => props.groupSelection.onToggle(node, v)}
                onClick={(e) => e.stopPropagation()}
                data-testid={`${props.kindPrefix}-group-select-${node.id}`}
              />
            )}
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {node.name}
            {node.pathPrefix && (
              <Badge variant="secondary" className="rounded-sm font-mono text-[10px] font-normal" data-testid={`${props.kindPrefix}-group-prefix-${node.id}`}>
                {node.pathPrefix}
              </Badge>
            )}
            <Badge variant="outline" className="rounded-sm text-[10px]">{node.totalCount}</Badge>
          </div>
        </TableCell>
      </TableRow>
      {!collapsed && node.items.length === 0 && node.children.length === 0 && (
        <TableRow key={`${key}-empty`}>
          <TableCell colSpan={props.colSpan} className="py-3 text-center text-xs text-muted-foreground" style={{ paddingLeft: indent + 20 }}>
            {props.emptyLabel}
          </TableCell>
        </TableRow>
      )}
      {!collapsed && node.items.map((item) => props.renderItemRow(item, indent + 20))}
      {!collapsed && node.children.map((child) => renderNode(child, props))}
    </Fragment>
  );
}

export default function GroupTreeRows({ tree, colSpan, collapsedGroups, toggleGroup, kindPrefix, renderItemRow, emptyLabel, groupSelection }) {
  return tree.map((node) => renderNode(node, { colSpan, collapsedGroups, toggleGroup, kindPrefix, renderItemRow, emptyLabel, groupSelection }));
}
