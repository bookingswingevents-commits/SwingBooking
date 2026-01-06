
insert into public.event_formats (slug, title, description, base_fee, duration_minutes) values
('dj-set-2h','DJ Set 2h','Performance DJ de 2 heures',400,120),
('live-band-1h','Live Band 1h','Groupe live 60 minutes',1200,60)
on conflict (slug) do nothing;
