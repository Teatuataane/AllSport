-- Fix players with legacy 'Youth' division value (renamed to 'Juniors')
UPDATE players SET division = 'Juniors' WHERE division = 'Youth';
