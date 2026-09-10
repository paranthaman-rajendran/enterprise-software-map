/**
 * The two layout extensions ship without types. They are registered once in GraphCanvas and
 * used only through Cytoscape's own layout options, so a minimal declaration is enough.
 */
declare module 'cytoscape-dagre' {
  import type { Ext } from 'cytoscape';
  const extension: Ext;
  export default extension;
}

declare module 'cytoscape-fcose' {
  import type { Ext } from 'cytoscape';
  const extension: Ext;
  export default extension;
}
