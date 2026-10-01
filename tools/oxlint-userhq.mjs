export default {
  meta: {
    name: "userhq",
  },
  rules: {
    "no-import-meta-env": {
      create(context) {
        return {
          MemberExpression(node) {
            if (
              node.object &&
              node.object.type === "MetaProperty" &&
              node.object.meta &&
              node.object.meta.name === "import" &&
              node.object.property &&
              node.object.property.name === "meta" &&
              node.property &&
              node.property.name === "env"
            ) {
              context.report({
                node,
                message:
                  "Avoid import.meta.env in web app code to keep next build escape hatch available",
              });
            }
          },
        };
      },
    },
    "no-exclusion-columns": {
      create(context) {
        return {
          Property(node) {
            const keyName = node.key && (node.key.name || node.key.value);
            if (
              keyName === "columns" &&
              node.value &&
              node.value.type === "ObjectExpression"
            ) {
              const hasFalse = (node.value.properties || []).some(
                (p) =>
                  p.type === "Property" &&
                  p.value &&
                  p.value.type === "Literal" &&
                  p.value.value === false
              );
              if (hasFalse) {
                context.report({
                  node,
                  message:
                    "Exclusion-mode column selection ({ col: false }) is forbidden to prevent fail-open data leaks",
                });
              }
            }
          },
        };
      },
    },
  },
};
