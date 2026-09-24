/**
 * Types de la base, alignés sur supabase/migrations.
 * À regénérer quand le schéma change :
 *   npx supabase gen types typescript --project-id <id> --schema public > src/lib/database.types.ts
 */

type Timestamp = string;

export type Objectif = 'perte' | 'maintien' | 'prise';
export type Sexe = 'femme' | 'homme';
export type Plan = 'free' | 'premium';
export type TypeRepas = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'en_cas';
export type FoodCategorie =
  | 'feculent'
  | 'plat_complet'
  | 'sauce'
  | 'proteine'
  | 'legume'
  | 'fruit'
  | 'matiere_grasse'
  | 'snack'
  | 'boisson'
  | 'sucre';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProfileRow = {
  id: string;
  prenom: string | null;
  sexe: Sexe | null;
  age: number | null;
  taille_cm: number | null;
  poids_kg: number | null;
  niveau_activite: number | null;
  objectif: Objectif | null;
  calories_cible: number | null;
  plan: Plan;
  partage_photos: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type FoodRow = {
  id: number;
  food_key: string;
  label_fr: string;
  aliases: string[];
  categorie: FoodCategorie;
  kcal_100g: number;
  proteines_100g: number;
  glucides_100g: number;
  lipides_100g: number;
  portion_reperes: Record<string, number>;
  source: string;
  verified: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type MealRow = {
  id: string;
  user_id: string;
  eaten_at: Timestamp;
  type_repas: TypeRepas;
  photo_path: string | null;
  total_kcal: number;
  total_proteines: number;
  total_glucides: number;
  total_lipides: number;
  confidence_globale: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type MealItemRow = {
  id: string;
  meal_id: string;
  position: number;
  food_key: string | null;
  label: string;
  grams: number;
  kcal: number;
  proteines: number;
  glucides: number;
  lipides: number;
  estimated: boolean;
};

type CorrectionRow = {
  id: string;
  user_id: string;
  meal_id: string | null;
  predicted: Json;
  corrected: Json;
  photo_path: string | null;
  created_at: Timestamp;
};

type ScanUsageRow = { user_id: string; day: string; count: number };

/** Champs du profil modifiables par l'utilisateur (droits par colonne en base). */
export type ProfileUpdate = Partial<
  Pick<
    ProfileRow,
    'prenom' | 'sexe' | 'age' | 'taille_cm' | 'poids_kg' | 'niveau_activite' | 'objectif' | 'calories_cible' | 'partage_photos'
  >
>;

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type WithDefaults<Row, Optional extends keyof Row> = Omit<Row, Optional> & Partial<Pick<Row, Optional>>;

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, never, ProfileUpdate>;
      foods: Table<FoodRow, never, never>;
      meals: Table<
        MealRow,
        WithDefaults<
          MealRow,
          | 'id'
          | 'user_id'
          | 'eaten_at'
          | 'photo_path'
          | 'total_kcal'
          | 'total_proteines'
          | 'total_glucides'
          | 'total_lipides'
          | 'confidence_globale'
          | 'created_at'
          | 'updated_at'
        >
      >;
      meal_items: Table<MealItemRow, WithDefaults<MealItemRow, 'id' | 'position' | 'food_key' | 'estimated'>>;
      corrections: Table<CorrectionRow, WithDefaults<CorrectionRow, 'id' | 'user_id' | 'meal_id' | 'photo_path' | 'created_at'>>;
      scan_usage: Table<ScanUsageRow, never, never>;
    };
    Views: Record<never, never>;
    Functions: {
      get_scan_status: {
        Args: Record<never, never>;
        Returns: { used: number; quota: number; remaining: number }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Profile = ProfileRow;
export type Food = FoodRow;
export type Meal = MealRow;
export type MealItem = MealItemRow;
