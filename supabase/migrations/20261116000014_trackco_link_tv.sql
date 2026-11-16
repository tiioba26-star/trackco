-- Trackco · ver o link da TV de novo sem trocar
-- O link fica guardado cifrado (a chave está só no servidor do Trackco); a TV continua sendo
-- encontrada pelo hash. Sem a chave do servidor, o texto guardado não serve para nada.
alter table trackco.paineis_tv add column if not exists token_cifrado text;
comment on column trackco.paineis_tv.token_cifrado is
  'Link da TV cifrado (AES-256-GCM, chave no servidor), para mostrar de novo sem trocar o link.';
