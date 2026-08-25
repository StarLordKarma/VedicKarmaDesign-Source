// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Router } from "wouter";
import Privacy from "./Privacy";

function renderPrivacy(language: string) {
  window.localStorage.clear();
  window.localStorage.setItem("public-locale", language);
  window.history.replaceState({}, "", "/privacy");
  return render(<Router><Privacy /></Router>);
}

describe("Privacy page", () => {
  it.each([
    ["en", "How we handle personal data", "1. Controller and contact", "6. Rights and complaints", "9. Astrology service disclaimer"],
    ["ru", "Как мы обрабатываем персональные данные", "1. Оператор и контакт", "6. Права и жалобы", "9. Дисклеймер услуги"],
    ["de", "Wie wir personenbezogene Daten verarbeiten", "1. Verantwortlicher und Kontakt", "6. Rechte und Beschwerden", "9. Hinweis zum Angebot"],
    ["es", "Cómo tratamos los datos personales", "1. Responsable y contacto", "6. Derechos y reclamaciones", "9. Aviso sobre el servicio"],
  ])("renders the localized notice for %s", (language, title, controller, rights, disclaimer) => {
    renderPrivacy(language);
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByRole("heading", { name: controller })).toBeTruthy();
    expect(screen.getByRole("heading", { name: rights })).toBeTruthy();
    expect(screen.getByRole("heading", { name: disclaimer })).toBeTruthy();
  });
});
