export function getDescendantIds(groupId, groups) {
  const childrenOf = new Map();
  groups.forEach((g) => {
    if (!childrenOf.has(g.parent_id)) childrenOf.set(g.parent_id, []);
    childrenOf.get(g.parent_id).push(g.id);
  });
  const result = new Set();
  const stack = [...(childrenOf.get(groupId) || [])];
  while (stack.length) {
    const id = stack.pop();
    if (result.has(id)) continue;
    result.add(id);
    stack.push(...(childrenOf.get(id) || []));
  }
  return result;
}

export function flattenGroupTree(groups) {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const childrenOf = new Map();
  groups.forEach((g) => {
    const key = g.parent_id && byId.has(g.parent_id) ? g.parent_id : "root";
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key).push(g);
  });
  const result = [];
  const visit = (parentKey, depth) => {
    (childrenOf.get(parentKey) || []).forEach((g) => {
      result.push({ ...g, depth });
      visit(g.id, depth + 1);
    });
  };
  visit("root", 0);
  return result;
}


export function computeGroupPrefix(groupId, groups) {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const normalize = (p) => {
    p = (p || "").trim();
    if (!p) return "";
    if (!p.startsWith("/")) p = "/" + p;
    return p.replace(/\/+$/, "");
  };
  const resolve = (gid, depth = 0) => {
    if (!gid || depth > 20) return "";
    const g = byId.get(gid);
    if (!g) return "";
    return resolve(g.parent_id, depth + 1) + normalize(g.path_prefix);
  };
  return resolve(groupId);
}
