declare module "@tabler/icons/icons.json" {
  const value: Record<
    string,
    {
      name: string;
      category?: string;
      tags?: string[];
    }
  >;

  export default value;
}

declare module "@tabler/icons/tabler-nodes-outline.json" {
  const value: Record<string, Array<[string, Record<string, string | number | boolean>]>>;
  export default value;
}
