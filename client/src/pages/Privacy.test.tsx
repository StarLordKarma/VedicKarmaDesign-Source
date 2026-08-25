// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { Router } from "wouter";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Privacy from "./Privacy";

function renderPrivacy(language: string) {
  window.localStorage.clear();
  window.localStorage.setItem("public-locale", language);
  window.history.replaceState({}, "", "/privacy");
  return render(<ThemeProvider switchable><Router><Privacy /></Router></ThemeProvider>);
}

describe("Privacy page", () => {
  afterEach(() => cleanup());
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
    expect(screen.getByRole("group", { name: /Choose language|Выберите язык|Sprache wählen|Elegir idioma/ })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: /On this page|В этом документе|Auf dieser Seite|En esta página/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: new RegExp(`^1\\.`) })).toHaveAttribute("href", "#privacy-section-1");
  });

  it("changes language from the prominent switcher and keeps section links available", () => {
    renderPrivacy("en");
    fireEvent.click(screen.getByRole("button", { name: "Русский" }));
    expect(screen.getByRole("heading", { name: "Как мы обрабатываем персональные данные" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Русский" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Наверх" })).toHaveAttribute("href", "#privacy-top");
  });

  it("restores the saved locale and theme on a later visit", () => {
    window.localStorage.setItem("public-locale", "de");
    window.localStorage.setItem("theme", "dark");
    window.history.replaceState({}, "", "/privacy");
    render(<ThemeProvider switchable><Router><Privacy /></Router></ThemeProvider>);
    expect(screen.getByRole("heading", { name: "Wie wir personenbezogene Daten verarbeiten" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heller Modus" })).toBeInTheDocument();
  });

  it("toggles the Privacy theme and persists the new choice", () => {
    renderPrivacy("en");
    fireEvent.click(screen.getByRole("button", { name: "Dark mode" }));
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Light mode" })).toBeInTheDocument();
  });
});
