import { createMoveitClient } from "@moveit/supabase";

export const supabase = createMoveitClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  undefined,
  true,
);
