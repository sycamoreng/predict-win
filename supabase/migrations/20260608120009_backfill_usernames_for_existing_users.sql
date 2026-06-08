-- Backfill unique random usernames for all users that don't have one
DO $$
DECLARE
  rec RECORD;
  adj TEXT[];
  noun TEXT[];
  candidate TEXT;
  attempts INT;
BEGIN
  adj := ARRAY[
    'swift','bold','keen','cool','epic','fair','fast','gold',
    'iron','jade','nova','pure','rare','sage','vast','wise',
    'aqua','blue','calm','dawn','ever','free','glow','haze',
    'lush','mint','opal','peak','rich','silk','true','warm',
    'brave','crisp','deft','fleet','grand','lunar','prime','royal',
    'sleek','solar','vivid','agile','chill','noble','rapid','sonic'
  ];
  noun := ARRAY[
    'fox','hawk','wolf','lion','bear','dove','elk','lynx',
    'orca','puma','raven','viper','falcon','cobra','tiger','eagle',
    'spark','storm','blaze','frost','comet','flare','pulse','surge',
    'drift','ridge','stone','crest','flame','shade','trail','creek',
    'bolt','dash','echo','flash','glyph','nexus','prism','quest',
    'scout','striker','keeper','winger','ace','goal','pitch','volley'
  ];

  FOR rec IN SELECT id FROM synced_users WHERE username IS NULL LOOP
    attempts := 0;
    LOOP
      candidate := adj[1 + floor(random() * array_length(adj, 1))::int]
                   || '-'
                   || noun[1 + floor(random() * array_length(noun, 1))::int]
                   || '-'
                   || (1 + floor(random() * 99))::int::text;
      BEGIN
        UPDATE synced_users SET username = candidate WHERE id = rec.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        attempts := attempts + 1;
        IF attempts > 20 THEN
          -- fallback: append more digits
          candidate := candidate || floor(random() * 900 + 100)::int::text;
          UPDATE synced_users SET username = candidate WHERE id = rec.id;
          EXIT;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;
