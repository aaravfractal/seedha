/** Shapes returned by the Seedha API. Money is always integer paise. */

export type PropertyInfo = {
  name: string;
  short_name: string;
  city: string;
  address: string;
  rooms_count: number;
  owner_name: string;
  is_sample: boolean;
};

export type PipelineStatus = {
  steps: { key: string; done: boolean }[];
  done_count: number;
};
