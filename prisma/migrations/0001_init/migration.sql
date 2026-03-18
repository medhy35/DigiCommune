-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('agent', 'superviseur', 'maire', 'superadmin');

-- CreateEnum
CREATE TYPE "StatutDemande" AS ENUM ('recue', 'en_cours', 'complements_requis', 'complements_fournis', 'traitee', 'disponible', 'rejetee');

-- CreateEnum
CREATE TYPE "TypeActe" AS ENUM ('naissance', 'mariage', 'deces', 'attestation_concubinage', 'attestation_domicile', 'certification_documents', 'legalisation', 'inscription_livret', 'duplicata_livret', 'certificat_vie_entretien', 'certificat_vie_adulte', 'fiche_familiale', 'fiche_individuelle');

-- CreateEnum
CREATE TYPE "ModeReception" AS ENUM ('retrait', 'whatsapp');

-- CreateEnum
CREATE TYPE "StatutRdv" AS ENUM ('en_attente', 'confirme', 'effectue', 'annule');

-- CreateTable
CREATE TABLE "communes" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nom_app" TEXT NOT NULL DEFAULT 'DigiCommune',
    "region" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "site" TEXT NOT NULL DEFAULT '',
    "maire" TEXT NOT NULL DEFAULT '',
    "slogan" TEXT NOT NULL DEFAULT '',
    "horaires_ouverture" TEXT NOT NULL DEFAULT '',
    "couleur_primaire" TEXT NOT NULL DEFAULT '#009A44',
    "logo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "commune_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "email" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "commune_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes" (
    "id" TEXT NOT NULL,
    "commune_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "statut" "StatutDemande" NOT NULL DEFAULT 'recue',
    "type_acte" "TypeActe" NOT NULL,
    "concernant" TEXT NOT NULL,
    "demandeur" JSONB NOT NULL,
    "personne_concernee" JSONB,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "mode_reception" "ModeReception" NOT NULL DEFAULT 'retrait',
    "documents" JSONB NOT NULL DEFAULT '[]',
    "paiement" JSONB NOT NULL,
    "agent_id" TEXT,
    "acte" JSONB,
    "verification_codes" JSONB NOT NULL DEFAULT '{}',
    "complement_demande" JSONB,
    "complement_fourni" JSONB,
    "escalade" JSONB,
    "historique" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "demandes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "commune_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "demande_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rendez_vous" (
    "id" TEXT NOT NULL,
    "commune_id" TEXT NOT NULL,
    "demande_id" TEXT NOT NULL,
    "demandeur" JSONB NOT NULL,
    "date_rdv" TEXT NOT NULL,
    "heure_rdv" TEXT NOT NULL,
    "lieu" TEXT NOT NULL DEFAULT 'Mairie',
    "statut" "StatutRdv" NOT NULL DEFAULT 'en_attente',
    "note_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rendez_vous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "commune_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_logs" (
    "id" TEXT NOT NULL,
    "commune_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "acteur" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "commune_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nom_fichier" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT NOT NULL,
    "has_data" BOOLEAN NOT NULL DEFAULT true,
    "file_path" TEXT NOT NULL,
    "ext" TEXT NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_commune_id_email_key" ON "utilisateurs"("commune_id", "email");

-- CreateIndex
CREATE INDEX "sessions_utilisateur_id_idx" ON "sessions"("utilisateur_id");

-- CreateIndex
CREATE INDEX "sessions_commune_id_idx" ON "sessions"("commune_id");

-- CreateIndex
CREATE INDEX "demandes_commune_id_idx" ON "demandes"("commune_id");

-- CreateIndex
CREATE INDEX "demandes_commune_id_statut_idx" ON "demandes"("commune_id", "statut");

-- CreateIndex
CREATE INDEX "demandes_commune_id_agent_id_idx" ON "demandes"("commune_id", "agent_id");

-- CreateIndex
CREATE INDEX "notifications_commune_id_role_idx" ON "notifications"("commune_id", "role");

-- CreateIndex
CREATE INDEX "rendez_vous_commune_id_idx" ON "rendez_vous"("commune_id");

-- CreateIndex
CREATE INDEX "rendez_vous_commune_id_demande_id_idx" ON "rendez_vous"("commune_id", "demande_id");

-- CreateIndex
CREATE INDEX "rendez_vous_commune_id_date_rdv_idx" ON "rendez_vous"("commune_id", "date_rdv");

-- CreateIndex
CREATE UNIQUE INDEX "settings_commune_id_key" ON "settings"("commune_id");

-- CreateIndex
CREATE INDEX "security_logs_commune_id_idx" ON "security_logs"("commune_id");

-- CreateIndex
CREATE INDEX "security_logs_commune_id_type_idx" ON "security_logs"("commune_id", "type");

-- CreateIndex
CREATE INDEX "security_logs_commune_id_date_idx" ON "security_logs"("commune_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "templates_commune_id_type_key" ON "templates"("commune_id", "type");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_logs" ADD CONSTRAINT "security_logs_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

