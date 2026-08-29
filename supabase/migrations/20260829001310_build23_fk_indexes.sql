-- Build 23 follow-up: covering indexes for inference foreign keys reported by Supabase advisors.

create index if not exists ld_inference_jobs_worker_id_idx
  on public.ld_inference_jobs(worker_id);

create index if not exists ld_inference_leases_job_id_idx
  on public.ld_inference_leases(job_id);

create index if not exists ld_inference_leases_pool_id_idx
  on public.ld_inference_leases(pool_id);
