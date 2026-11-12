import { expect, test } from "vitest";
import { readSignInFailure } from "./signInFailure.ts";

test("a refused GitHub user gets the refusal, and the URL loses only the error", () => {
  expect(
    readSignInFailure({
      pathname: "/projects",
      searchStr: "?page=2&error=unable_to_get_user_info",
      hash: "top",
    }),
  ).toEqual({
    message: "この GitHub アカウントではサインインできません",
    href: "/projects?page=2#top",
  });
});

test("any other error gets the general message", () => {
  expect(
    readSignInFailure({ pathname: "/", searchStr: "?error=state_mismatch", hash: "" }),
  ).toEqual({ message: "サインインできませんでした", href: "/" });
});

test("a URL without an error is no failure", () => {
  expect(readSignInFailure({ pathname: "/", searchStr: "?page=2", hash: "" })).toBeNull();
});
