package workspace

import "testing"

func TestClassifyRepo(t *testing.T) {
	d := Detector{
		GitToplevel: func(dir string) (string, bool) { return "/home/me/proj", true },
		ChildRepos:  func(string) []string { return nil },
	}
	ctx := d.Classify("/home/me/proj/sub")
	if ctx.Kind != Repo {
		t.Fatalf("Kind = %q; want repo", ctx.Kind)
	}
	if ctx.RepoRoot != "/home/me/proj" || ctx.StateDir != "/home/me/proj/.orc" {
		t.Errorf("unexpected: %+v", ctx)
	}
}

func TestClassifyWorkspace(t *testing.T) {
	d := Detector{
		GitToplevel: func(string) (string, bool) { return "", false },
		ChildRepos:  func(string) []string { return []string{"api", "web"} },
	}
	ctx := d.Classify("/home/me/work")
	if ctx.Kind != Workspace {
		t.Fatalf("Kind = %q; want workspace", ctx.Kind)
	}
	if ctx.WorkspaceRoot != "/home/me/work" || ctx.WorkspaceName != "work" {
		t.Errorf("unexpected roots: %+v", ctx)
	}
	if ctx.StateDir != "/home/me/work/.orc" {
		t.Errorf("StateDir = %q", ctx.StateDir)
	}
	if len(ctx.Repos) != 2 {
		t.Errorf("Repos = %v", ctx.Repos)
	}
}

func TestClassifyLooseWhenSingleChildRepo(t *testing.T) {
	// One child repo is not enough to be a workspace (needs >= 2).
	d := Detector{
		GitToplevel: func(string) (string, bool) { return "", false },
		ChildRepos:  func(string) []string { return []string{"only"} },
	}
	if ctx := d.Classify("/home/me/x"); ctx.Kind != Loose {
		t.Fatalf("Kind = %q; want loose", ctx.Kind)
	}
}

func TestClassifyLoose(t *testing.T) {
	d := Detector{
		GitToplevel: func(string) (string, bool) { return "", false },
		ChildRepos:  func(string) []string { return nil },
	}
	ctx := d.Classify("/tmp/nowhere")
	if ctx.Kind != Loose || ctx.StateDir != "" {
		t.Errorf("expected loose with no state dir: %+v", ctx)
	}
}

func TestRepoBeatsWorkspace(t *testing.T) {
	// Being inside a git repo wins even if children look like repos.
	d := Detector{
		GitToplevel: func(string) (string, bool) { return "/r", true },
		ChildRepos:  func(string) []string { return []string{"a", "b"} },
	}
	if ctx := d.Classify("/r"); ctx.Kind != Repo {
		t.Errorf("repo should take precedence, got %q", ctx.Kind)
	}
}
